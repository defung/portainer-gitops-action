import * as core from '@actions/core'

import { extractProps } from './props'
import { processAction } from './actionProcessor'

const propsParseError: Error = {
  message: 'Failed to parse properties!',
  name: 'PropsParseError'
}

const handleFailure = async (err: Error): Promise<void> => {
  const errStr = JSON.stringify(err, null, 2)
  core.setFailed(errStr)
  return Promise.reject(errStr)
}

export const run = async (): Promise<void> => {
  const actionProps = extractProps()

  if (!actionProps) {
    return handleFailure(propsParseError)
  } else {
    // eslint-disable-next-line github/no-then
    try {
      return await processAction(actionProps)
    } catch (e) {
      return handleFailure(e as Error)
    }
  }
}
