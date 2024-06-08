"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const props_1 = require("./props");
const portainer_1 = require("./portainer");
const makePortainerApi = ({ apiKey, host }) => {
    const config = new portainer_1.Configuration({ apiKey: apiKey, basePath: `${host}/api/` });
    return (0, portainer_1.StacksApiFactory)(config, fetch);
};
const processAction = ({ action, portainer, repo }) => ({
    [props_1.ActionType.List]: async () => {
        const portainerApi = makePortainerApi(portainer);
        const list = await portainerApi.stackList();
        const filtered = list.filter((s) => s.endpointId === action.endpointId);
        const outputStr = JSON.stringify(filtered.map((s) => ({ 'Id': s.id, 'Name': s.name })));
        core_1.default.setOutput("stacks", outputStr);
    },
    [props_1.ActionType.Delete]: async () => {
        if (!action.stackName) {
            return Promise.reject("'stack-name' missing!");
        }
        else {
            const portainerApi = makePortainerApi(portainer);
            const list = await portainerApi.stackList();
            const stackToDelete = list.find((s) => s.endpointId === action.endpointId && s.name === action.stackName);
            if (!stackToDelete)
                core_1.default.setFailed(`Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
            else if (!stackToDelete.id)
                core_1.default.setFailed(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
            else {
                const res = await portainerApi.stackDelete(action.endpointId, stackToDelete.id);
                core_1.default.info(`Delete result: HTTP ${res.status}`);
            }
        }
    },
    [props_1.ActionType.Upsert]: async () => {
        var _a, _b;
        if (!action.stackName) {
            return Promise.reject("'stack-name' missing!");
        }
        else if (!repo.url) {
            return Promise.reject("'repo-url' missing!");
        }
        else {
            const portainerApi = makePortainerApi(portainer);
            const list = await portainerApi.stackList();
            const stackToUpdate = list.find((s) => s.endpointId === action.endpointId && s.name === action.stackName);
            if (stackToUpdate && !stackToUpdate.id) {
                return Promise.reject(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
            }
            else if (stackToUpdate && stackToUpdate.id) {
                const body = {
                    prune: true,
                    pullImage: true,
                };
                const res = await portainerApi.stackGitRedeploy(stackToUpdate.id, body, action.endpointId);
                core_1.default.info(`Update result: HTTP ${res.status}`);
                return Promise.resolve();
            }
            else {
                const body = {
                    name: action.stackName,
                    repositoryURL: repo.url,
                    composeFile: repo.composeFilePath,
                    repositoryAuthentication: repo.auth !== undefined,
                    repositoryUsername: (_a = repo.auth) === null || _a === void 0 ? void 0 : _a.username,
                    repositoryPassword: (_b = repo.auth) === null || _b === void 0 ? void 0 : _b.password,
                };
                const res = await portainerApi.stackCreateDockerStandaloneRepository(action.endpointId, body);
                core_1.default.info(`Create result: HTTP ${res.status}`);
                return Promise.resolve();
            }
        }
    },
});
const run = () => {
    const actionProps = (0, props_1.extractProps)();
    if (!actionProps) {
        core_1.default.setFailed("Failed to parse properties!");
    }
    else {
        const res = processAction(actionProps)[actionProps.action.type]();
        res.catch((r) => core_1.default.setFailed(r ? r.toString() : ''));
    }
};
run();
