import {
  ActionProps,
  ActionType,
  PortainerActionProps,
  RepoProps,
} from "./props";
import * as core from "@actions/core";
import {
  Configuration,
  StacksApi,
  StacksComposeStackFromGitRepositoryPayload,
  StacksStackGitRedployPayload,
} from "./generated-sources/portainer-ce-2.20.3";
import { AxiosInstance } from "axios";

const processList = async (
  stacksApi: StacksApi,
  action: ActionProps,
): Promise<void> => {
  return stacksApi
    .stackList(JSON.stringify({ EndpointId: action.endpointId }))
    .then((res) => res.data)
    .then((list) => {
      const outputStr = JSON.stringify(
        list.map((s) => ({ Id: s.Id, Name: s.Name })),
      );
      core.setOutput("stacks", outputStr);
    })
};

const processUpsert = async (
  stacksApi: StacksApi,
  action: ActionProps,
  repo: RepoProps,
): Promise<void> => {
  if (!action.stackName) {
    return Promise.reject("'stack-name' missing!");
  } else if (!repo.url) {
    return Promise.reject("'repo-url' missing!");
  } else {
    const list = (
      await stacksApi.stackList(
        JSON.stringify({ EndpointId: action.endpointId }),
      )
    ).data;
    const stackToUpdate = list.find(
      (s) => s.EndpointId === action.endpointId && s.Name === action.stackName,
    );

    if (stackToUpdate && !stackToUpdate.Id) {
      return Promise.reject(
        `Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`,
      );
    } else if (stackToUpdate && stackToUpdate.Id) {
      const body: StacksStackGitRedployPayload = {
        prune: true,
        pullImage: true,
        repositoryAuthentication: repo.auth !== undefined,
        repositoryUsername: repo.auth?.username,
        repositoryPassword: repo.auth?.password,
      };
      return stacksApi
        .stackGitRedeploy(stackToUpdate.Id, body, action.endpointId)
        .then((res) => core.info(`Update result: HTTP ${res.status}`));
    } else {
      const body: StacksComposeStackFromGitRepositoryPayload = {
        name: action.stackName,
        composeFile: action.composeFilePath,
        repositoryURL: repo.url,
        repositoryAuthentication: repo.auth !== undefined,
        repositoryUsername: repo.auth?.username,
        repositoryPassword: repo.auth?.password,
      };

      return stacksApi
        .stackCreateDockerStandaloneRepository(action.endpointId, body)
        .then((res) => core.info(`Create result: HTTP ${res.status}`));
    }
  }
};

const processDelete = async (
  stacksApi: StacksApi,
  action: ActionProps,
): Promise<void> => {
  if (!action.stackName) {
    return Promise.reject("'stack-name' missing!");
  } else {
    const list = (
      await stacksApi.stackList(
        JSON.stringify({ EndpointId: action.endpointId }),
      )
    ).data;
    const stackToDelete = list.find(
      (s) => s.EndpointId === action.endpointId && s.Name === action.stackName,
    );

    if (!stackToDelete) {
      return Promise.reject(
        `Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`,
      );
    } else if (!stackToDelete.Id)
      return Promise.reject(
        `Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`,
      );
    else {
      return stacksApi
        .stackDelete(stackToDelete.Id, action.endpointId)
        .then((res) => core.info(`Delete result: HTTP ${res.status}`));
    }
  }
};

export const processAction = async (
  { action, portainer, repo }: PortainerActionProps,
  axios?: AxiosInstance,
): Promise<void> => {
  const config = new Configuration({ apiKey: portainer.apiKey });
  const stacksApi = new StacksApi(config, `${portainer.host}/api`, axios);

  switch (action.type) {
    case ActionType.List:
      return processList(stacksApi, action);
    case ActionType.Upsert:
      return processUpsert(stacksApi, action, repo);
    case ActionType.Delete:
      return processDelete(stacksApi, action);
  }
};
