import * as core from '@actions/core'

export enum ActionType {
  List = 'list',
  Upsert = 'upsert',
  Delete = 'delete'
}

export interface ActionProps {
  type: ActionType
  endpointId: number
  stackName?: string
  composeFilePath?: string
}

export interface PortainerProps {
  host: string
  apiKey: string
}

export interface RepoProps {
  url?: string
  auth?: {
    username: string
    password: string
  }
}

export interface PortainerActionProps {
  action: ActionProps
  portainer: PortainerProps
  repo: RepoProps
}

const toActionType = (str: string): ActionType | undefined =>
  Object.values(ActionType).find(a => a.valueOf() === str)

const toNumber = (str: string): number | undefined => {
  const num = Number(str)
  return Number.isNaN(num) ? undefined : num
}

const props = {
  getRequired: <O>(
    propName: string,
    validate: (str: string) => O | undefined
  ): O => {
    const str = core.getInput(propName, { required: true })
    const validated = validate(str)

    if (!validated)
      throw new Error(`'${str}' is not a valid value for '${propName}'!`)
    else return validated
  },
  getRequiredStr: (propName: string): string =>
    props.getRequired<string>(propName, (str: string) => str),
  getRequiredByAction: <O>(
    propName: string,
    currentAction: ActionType,
    requiredFor: ActionType[],
    validate: (str: string) => O | undefined
  ): O | undefined => {
    const required = requiredFor.find(r => r === currentAction) !== undefined
    const str = core.getInput(propName, { required })

    if (!str) return undefined
    else {
      const validated = validate(str)

      if (!validated)
        throw new Error(`'${str}' is not a valid value for '${propName}'!`)
      else return validated
    }
  },
  getRequiredByActionStr: (
    propName: string,
    currentAction: ActionType,
    requiredFor: ActionType[]
  ): string | undefined =>
    props.getRequiredByAction<string>(
      propName,
      currentAction,
      requiredFor,
      (str: string) => str
    )
}

export const extractProps = (): PortainerActionProps | undefined => {
  const actionType = props.getRequired<ActionType>('action', toActionType)

  const authUsername = core.getInput('repo-username')
  const authPassword = core.getInput('repo-password')

  const auth =
    !authUsername || !authPassword
      ? undefined
      : {
          username: authUsername,
          password: authPassword
        }

  return {
    action: {
      type: actionType,
      endpointId: props.getRequired<number>('endpoint-id', toNumber),
      stackName: props.getRequiredByActionStr('stack-name', actionType, [
        ActionType.Upsert,
        ActionType.Delete
      ]),
      composeFilePath: props.getRequiredByActionStr(
        'repo-compose-file-path',
        actionType,
        [ActionType.Upsert]
      )
    },
    portainer: {
      host: props.getRequiredStr('portainer-host'),
      apiKey: props.getRequiredStr('portainer-api-key')
    },
    repo: {
      url: props.getRequiredByActionStr('repo-url', actionType, [
        ActionType.Upsert
      ]),
      auth
    }
  }
}
