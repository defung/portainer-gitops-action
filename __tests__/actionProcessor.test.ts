/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

// eslint-disable-next-line filenames/match-regex
import * as actionProcessor from '../src/actionProcessor'
import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'
import {
  ActionType,
  PortainerActionProps,
  PortainerProps,
  RepoProps
} from '../src/props'
import { PortainerStack } from '../src/generated-sources/portainer-ce-2.20.3'

const baseUrl = 'http://localhost:8000'
const apiKey = 'super-secret-api-key'

const portainerProps: PortainerProps = {
  host: baseUrl,
  apiKey
}

const repoProps: RepoProps = {
  url: 'https://github.com/defung/docker',
  auth: {
    username: 'defung',
    password: 'super-secret-gh-pat'
  }
}

const baseProps = {
  portainer: portainerProps,
  repo: repoProps
}

const listProps: PortainerActionProps = {
  ...baseProps,
  action: {
    type: ActionType.List,
    endpointId: 1
  }
}

const upsertProps: PortainerActionProps = {
  ...baseProps,
  action: {
    type: ActionType.Upsert,
    endpointId: 1,
    stackName: 'myStack',
    composeFilePath: 'myStack/docker-compose.yml'
  }
}

const deleteProps: PortainerActionProps = {
  ...baseProps,
  action: {
    type: ActionType.Delete,
    endpointId: 1,
    stackName: 'myStack'
  }
}

const createMockAxios = (
  listRes: PortainerStack[]
): [AxiosInstance, AxiosMockAdapter] => {
  const axiosInstance = axios.create()
  const mockAxios = new AxiosMockAdapter(axiosInstance)

  mockAxios
    .onGet(
      'http://localhost:8000/api/stacks?filters=%7B%22EndpointId%22%3A1%7D'
    )
    .reply(200, listRes)

  return [axiosInstance, mockAxios]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getHeaders = (req: AxiosRequestConfig<any>): Map<string, string> => {
  const requestJson = JSON.parse(JSON.stringify(req))
  return new Map<string, string>(Object.entries(requestJson.headers ?? {}))
}

describe('actionProcessor', () => {
  it('properly handles "List" action', async () => {
    const [axiosInstance, mockAxios] = createMockAxios([
      { Name: 'stack1', Id: 100, EndpointId: 1 }
    ])

    await actionProcessor.processAction(listProps, axiosInstance)

    const getHistory = mockAxios.history.get

    expect(getHistory).toHaveLength(1)

    const request = getHistory[0]
    const requestHeaders = getHeaders(request)

    expect(requestHeaders.get('X-API-KEY')).toBe(apiKey)
    expect(requestHeaders.get('Authorization')).toBe(undefined)
    expect(request.url).toBe(
      'http://localhost:8000/api/stacks?filters=%7B%22EndpointId%22%3A1%7D'
    )
    expect(requestHeaders.size).toBeGreaterThanOrEqual(1)
  })

  it('properly handles "Upsert" action: Create', async () => {
    const [axiosInstance, mockAxios] = createMockAxios([
      { Name: 'stack1', Id: 100, EndpointId: 1 }
    ])

    mockAxios
      .onPost(
        'http://localhost:8000/api/stacks/create/standalone/repository?endpointId=1'
      )
      .reply(200, {})

    await actionProcessor.processAction(upsertProps, axiosInstance)

    const postHistory = mockAxios.history.post

    expect(postHistory).toHaveLength(1)

    const request = postHistory[0]
    const requestHeaders = getHeaders(request)

    const expectedRequestBody = {
      name: upsertProps.action.stackName,
      composeFile: upsertProps.action.composeFilePath,
      repositoryURL: upsertProps.repo.url,
      repositoryAuthentication: upsertProps.repo.auth !== undefined,
      repositoryUsername: upsertProps.repo.auth?.username,
      repositoryPassword: upsertProps.repo.auth?.password
    }

    expect(requestHeaders.get('X-API-KEY')).toBe(apiKey)
    expect(requestHeaders.get('Authorization')).toBe(undefined)
    expect(request.url).toBe(
      'http://localhost:8000/api/stacks/create/standalone/repository?endpointId=1'
    )
    expect(JSON.parse(request.data)).toMatchObject(expectedRequestBody)
  })

  it('properly handles "Upsert" action: Update', async () => {
    const [axiosInstance, mockAxios] = createMockAxios([
      { Name: 'stack1', Id: 100, EndpointId: 1 },
      { Name: 'myStack', Id: 101, EndpointId: 1 }
    ])

    mockAxios
      .onPut('http://localhost:8000/api/stacks/101/git/redeploy?endpointId=1')
      .reply(200, {})

    await actionProcessor.processAction(upsertProps, axiosInstance)

    const putHistory = mockAxios.history.put

    expect(putHistory).toHaveLength(1)

    const request = putHistory[0]
    const requestHeaders = getHeaders(request)

    const expectedRequestBody = {
      prune: true,
      pullImage: true,
      repositoryAuthentication: upsertProps.repo.auth !== undefined,
      repositoryUsername: upsertProps.repo.auth?.username,
      repositoryPassword: upsertProps.repo.auth?.password
    }

    expect(requestHeaders.get('X-API-KEY')).toBe(apiKey)
    expect(requestHeaders.get('Authorization')).toBe(undefined)
    expect(request.url).toBe(
      'http://localhost:8000/api/stacks/101/git/redeploy?endpointId=1'
    )
    expect(JSON.parse(request.data)).toMatchObject(expectedRequestBody)
  })

  it('properly handles "Delete" action: Found Stack', async () => {
    const [axiosInstance, mockAxios] = createMockAxios([
      { Name: 'stack1', Id: 100, EndpointId: 1 },
      { Name: 'myStack', Id: 101, EndpointId: 1 }
    ])

    mockAxios
      .onDelete('http://localhost:8000/api/stacks/101?endpointId=1')
      .reply(200, {})

    await actionProcessor.processAction(deleteProps, axiosInstance)

    const deleteHistory = mockAxios.history.delete

    expect(deleteHistory).toHaveLength(1)

    const request = deleteHistory[0]
    const requestHeaders = getHeaders(request)

    expect(requestHeaders.get('X-API-KEY')).toBe(apiKey)
    expect(requestHeaders.get('Authorization')).toBe(undefined)
    expect(request.url).toBe(
      'http://localhost:8000/api/stacks/101?endpointId=1'
    )
  })
})
