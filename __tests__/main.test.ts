/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import * as props from "../src/props";
import * as actionProcessor from "../src/actionProcessor";
import * as main from "../src/main";
import {
  ActionType,
  PortainerActionProps,
  PortainerProps,
  RepoProps,
} from "../src/props";

const portainerProps: PortainerProps = {
  host: "http://localhost:8000/api",
  apiKey: "super-secret-api-key",
};

const repoProps: RepoProps = {
  url: "https://github.com/defung/docker",
  auth: {
    username: "defung",
    password: "super-secret-gh-pat",
  },
};

const baseProps = {
  portainer: portainerProps,
  repo: repoProps,
};

const listProps: PortainerActionProps = {
  ...baseProps,
  action: {
    type: ActionType.List,
    endpointId: 1,
  },
};

// Mock the action's entrypoint

describe("main", () => {
  it("calls extractProps and actionProcessor", async () => {
    const extractPropsMock = jest
      .spyOn(props, "extractProps")
      .mockImplementation(() => listProps);
    const actionProcessorMock = jest
      .spyOn(actionProcessor, "processAction")
      .mockImplementation(async (): Promise<void> => {});

    await main.run();

    expect(extractPropsMock).toHaveBeenCalled();
    expect(actionProcessorMock).toHaveBeenCalled();
  })

  it("fails if extractProps returns undefined", async () => {
    jest.spyOn(props, "extractProps").mockImplementation(() => undefined);
    const actionProcessorMock = jest
      .spyOn(actionProcessor, "processAction")
      .mockImplementation(async (): Promise<void> => {});

    await expect(main.run()).rejects.toEqual(
      JSON.stringify(
        { message: "Failed to parse properties!", name: "PropsParseError" },
        null,
        2,
      ),
    );
    expect(actionProcessorMock).not.toHaveBeenCalled();
  })

  it("fails if processor fails", async () => {
    jest.spyOn(props, "extractProps").mockImplementation(() => listProps);
    jest
      .spyOn(actionProcessor, "processAction")
      .mockRejectedValue({ message: "some-error", name: "ProcessorError" });

    await expect(main.run()).rejects.toEqual(
      JSON.stringify(
        { message: "some-error", name: "ProcessorError" },
        null,
        2,
      ),
    );
  })
});
