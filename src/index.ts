import * as core from '@actions/core';

import {ActionType, extractProps, PortainerActionProps, PortainerProps} from "./props";
import {
  Configuration,
  StacksApiFactory,
  StacksComposeStackFromGitRepositoryPayload,
  StacksStackGitRedployPayload
} from "./portainer";

const makePortainerApi = ({ apiKey, host }: PortainerProps) => {
  const config = new Configuration({ apiKey: apiKey, basePath: `${host}/api/` });
  return StacksApiFactory(config, fetch);
}

const processAction = ({ action, portainer, repo }: PortainerActionProps): Record<ActionType, () => Promise<void>> => ({

  [ActionType.List]: async (): Promise<void> => {
    const portainerApi = makePortainerApi(portainer);

    const list = await portainerApi.stackList();
    const filtered = list.filter((s) => s.endpointId === action.endpointId);
    const outputStr = JSON.stringify(filtered.map((s) => ({ 'Id': s.id, 'Name': s.name })));
    core.setOutput("stacks", outputStr);
  },

  [ActionType.Delete]: async (): Promise<void> => {
    if (!action.stackName) {
      return Promise.reject("'stack-name' missing!");
    } else {
      const portainerApi = makePortainerApi(portainer);

      const list = await portainerApi.stackList();
      const stackToDelete = list.find((s) => s.endpointId === action.endpointId && s.name === action.stackName);

      if (!stackToDelete)
        core.setFailed(`Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      else if (!stackToDelete.id)
        core.setFailed(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      else {
        const res = await portainerApi.stackDelete(action.endpointId, stackToDelete.id);
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

      const list = await portainerApi.stackList();
      const stackToUpdate = list.find((s) => s.endpointId === action.endpointId && s.name === action.stackName);

      if (stackToUpdate && !stackToUpdate.id) {
        return Promise.reject(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
      } else if (stackToUpdate && stackToUpdate.id) {
        const body: StacksStackGitRedployPayload = {
          prune: true,
          pullImage: true,
        }
        const res = await portainerApi.stackGitRedeploy(stackToUpdate.id, body, action.endpointId);
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

const run = () => {
  const actionProps = extractProps();

  if (!actionProps) {
    core.setFailed("Failed to parse properties!");
  } else {
    const res = processAction(actionProps)[actionProps.action.type]();
    res.catch((r) => core.setFailed(r ? r.toString() : ''))
  }
}

run();

