import {
  ActionProps,
  ActionType,
  PortainerActionProps,
  RepoProps
} from './props'
import * as core from '@actions/core'
import {
  Configuration,
  StacksApi,
  StacksComposeStackFromGitRepositoryPayload,
  StacksStackGitRedployPayload
} from './generated-sources/portainer-ce-2.20.3'
import type { AxiosInstance } from 'axios'

const missingPropError = (msg: string): Error => ({
  name: 'MissingPropError',
  message: msg
})

const parseResponseError = (msg: string): Error => ({
  name: 'ParseResponseError',
  message: msg
})

const stackNotFoundError = (msg: string): Error => ({
  name: 'StackNotFoundError',
  message: msg
})

const processList = async (
  stacksApi: StacksApi,
  action: ActionProps
): Promise<void> => {
  const res = await stacksApi.stackList(
    JSON.stringify({ EndpointId: action.endpointId })
  )
  const outputStr = JSON.stringify(
    res.data.map(s => ({ Id: s.Id, Name: s.Name }))
  )
  return core.setOutput('stacks', outputStr)
}

const processUpsert = async (
  stacksApi: StacksApi,
  action: ActionProps,
  repo: RepoProps
): Promise<void> => {
  if (!action.stackName) {
    return Promise.reject(missingPropError("'stack-name' missing!"))
  } else if (!repo.url) {
    return Promise.reject(missingPropError("'repo-url' missing!"))
  } else {
    const list = (
      await stacksApi.stackList(
        JSON.stringify({ EndpointId: action.endpointId })
      )
    ).data
    const stackToUpdate = list.find(
      s => s.EndpointId === action.endpointId && s.Name === action.stackName
    )

    if (stackToUpdate && !stackToUpdate.Id) {
      return Promise.reject(
        parseResponseError(
          `Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`
        )
      )
    } else if (stackToUpdate && stackToUpdate.Id) {
      const body: StacksStackGitRedployPayload = {
        env: stackToUpdate.Env,
        prune: true,
        pullImage: true,
        repositoryAuthentication: repo.auth !== undefined,
        repositoryUsername: repo.auth?.username,
        repositoryPassword: repo.auth?.password
      }
      const res = await stacksApi.stackGitRedeploy(
        stackToUpdate.Id,
        body,
        action.endpointId
      )
      return core.info(`Update result: HTTP ${res.status}`)
    } else {
      const body: StacksComposeStackFromGitRepositoryPayload = {
        name: action.stackName,
        composeFile: action.composeFilePath,
        repositoryURL: repo.url,
        repositoryAuthentication: repo.auth !== undefined,
        repositoryUsername: repo.auth?.username,
        repositoryPassword: repo.auth?.password
      }

      const res = await stacksApi.stackCreateDockerStandaloneRepository(
        action.endpointId,
        body
      )
      return core.info(`Create result: HTTP ${res.status}`)
    }
  }
}

const processDelete = async (
  stacksApi: StacksApi,
  action: ActionProps
): Promise<void> => {
  if (!action.stackName) {
    return Promise.reject(missingPropError("'stack-name' missing!"))
  } else {
    const list = (
      await stacksApi.stackList(
        JSON.stringify({ EndpointId: action.endpointId })
      )
    ).data
    const stackToDelete = list.find(
      s => s.EndpointId === action.endpointId && s.Name === action.stackName
    )

    if (!stackToDelete) {
      return Promise.reject(
        stackNotFoundError(
          `Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`
        )
      )
    } else if (!stackToDelete.Id)
      return Promise.reject(
        parseResponseError(
          `Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`
        )
      )
    else {
      const res = await stacksApi.stackDelete(
        stackToDelete.Id,
        action.endpointId
      )
      return core.info(`Delete result: HTTP ${res.status}`)
    }
  }
}

export const processAction = async (
  { action, portainer, repo }: PortainerActionProps,
  axios?: AxiosInstance
): Promise<void> => {
  const config = new Configuration({ apiKey: portainer.apiKey })
  const stacksApi = new StacksApi(config, `${portainer.host}/api`, axios)

  switch (action.type) {
    case ActionType.List:
      return processList(stacksApi, action)
    case ActionType.Upsert:
      return processUpsert(stacksApi, action, repo)
    case ActionType.Delete:
      return processDelete(stacksApi, action)
  }
}
