import * as core from '@actions/core';

import {extractProps} from "./props";
import {processAction} from "./actionProcessor";

const run = () => {
  const actionProps = extractProps();

  if (!actionProps) {
    core.setFailed("Failed to parse properties!");
  } else {
    const res = processAction(actionProps)[actionProps.action.type]();
    res.catch((r: Error) => core.setFailed(`${r.message}\n${r.stack}`));
  }
}

run();
