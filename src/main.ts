import * as core from "@actions/core";

import { extractProps } from "./props";
import { processAction } from "./actionProcessor";

const propsParseError: Error = {
  message: "Failed to parse properties!",
  name: "PropsParseError",
};

const handleFailure = async (err: any): Promise<void> => {
  const errStr = JSON.stringify(err, null, 2);
  core.setFailed(errStr);
  return Promise.reject(errStr);
};

export const run = async () => {
  const actionProps = extractProps();

  if (!actionProps) {
    return handleFailure(propsParseError);
  } else {
    return processAction(actionProps).catch(handleFailure);
  }
};
