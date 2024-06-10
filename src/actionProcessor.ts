import {ActionType, PortainerActionProps, PortainerProps} from "./props";
import * as core from "@actions/core";
import {
  Configuration, StacksApi,
  StacksComposeStackFromGitRepositoryPayload,
  StacksStackGitRedployPayload
} from "./generated-sources/portainer-ce-2.20.3";

const makePortainerApi = ({ apiKey, host }: PortainerProps) => {
  const config = new Configuration({ apiKey: apiKey, basePath: `${host}/api` });
  return new StacksApi(config);
}

export const processAction = ({ action, portainer, repo }: PortainerActionProps): Record<ActionType, () => Promise<void>> => ({

  [ActionType.List]: async (): Promise<void> => {
    const portainerApi = makePortainerApi(portainer);

    const list = (await portainerApi.stackList()).data;
    const filtered = list.filter((s) => s.EndpointId === action.endpointId);
    const outputStr = JSON.stringify(filtered.map((s) => ({ 'Id': s.Id, 'Name': s.Name })));
    core.setOutput("stacks", outputStr);
  },

  [ActionType.Delete]: async (): Promise<void> => {
    if (!action.stackName) {
      return Promise.reject("'stack-name' missing!");
    } else {
      const portainerApi = makePortainerApi(portainer);

      const list = (await portainerApi.stackList()).data;
      const stackToDelete = list.find((s) => s.EndpointId === action.endpointId && s.Name === action.stackName);

      if (!stackToDelete)
        core.setFailed(`Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      else if (!stackToDelete.Id)
        core.setFailed(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      else {
        const res = await portainerApi.stackDelete(action.endpointId, stackToDelete.Id);
        core.info(`Delete result: HTTP ${res.status}`);
      }
    }
  },

  [ActionType.Upsert]: async (): Promise<void> => {
    if (!action.stackName) {
      return Promise.reject("'stack-name' missing!");
    } else if (!repo.url) {
      return Promise.reject("'repo-url' missing!");
    } else {
      const portainerApi = makePortainerApi(portainer);

      const list = (await portainerApi.stackList()).data;
      const stackToUpdate = list.find((s) => s.EndpointId === action.endpointId && s.Name === action.stackName);

      if (stackToUpdate && !stackToUpdate.Id) {
        return Promise.reject(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      } else if (stackToUpdate && stackToUpdate.Id) {
        const body: StacksStackGitRedployPayload = {
          prune: true,
          pullImage: true,
        }
        const res = await portainerApi.stackGitRedeploy(stackToUpdate.Id, body, action.endpointId);
        core.info(`Update result: HTTP ${res.status}`);
        return Promise.resolve();
      } else {
        const body: StacksComposeStackFromGitRepositoryPayload = {
          name: action.stackName,
          repositoryURL: repo.url,
          composeFile: repo.composeFilePath,
          repositoryAuthentication: repo.auth !== undefined,
          repositoryUsername: repo.auth?.username,
          repositoryPassword: repo.auth?.password,
        };

        const res = await portainerApi.stackCreateDockerStandaloneRepository(action.endpointId, body);

        core.info(`Create result: HTTP ${res.status}`);
        return Promise.resolve();
      }
    }
  },
});
