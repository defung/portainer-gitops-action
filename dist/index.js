"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
const props_1 = require("./props");
const portainer_1 = require("./portainer");
const makePortainerApi = ({ apiKey, host }) => {
    const config = new portainer_1.Configuration({ apiKey: apiKey, basePath: `${host}/api` });
    return new portainer_1.StacksApi(config);
};
const makePortainerApi2 = ({ apiKey, host }) => {
    const config = { apiKey: apiKey, basePath: `${host}/api` };
    return {
        stackList: async () => {
            const res = await (0, axios_1.default)(`${config.basePath}/stacks`, { headers: { 'X-API-KEY': apiKey } });
            return res.data;
        }
    };
};
const processAction = ({ action, portainer, repo }) => ({
    [props_1.ActionType.List]: async () => {
        const portainerApi = makePortainerApi(portainer);
        const list = await portainerApi.stackList();
        const filtered = list.filter((s) => s.endpointId === action.endpointId);
        const outputStr = JSON.stringify(filtered.map((s) => ({ 'Id': s.id, 'Name': s.name })));
        core.setOutput("stacks", outputStr);
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
                core.setFailed(`Unable to find stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
            else if (!stackToDelete.id)
                core.setFailed(`Unable to extract ID from stack: [endpointId=${action.endpointId}, stackName=${action.stackName}]`);
            else {
                const res = await portainerApi.stackDelete(action.endpointId, stackToDelete.id);
                core.info(`Delete result: HTTP ${res.status}`);
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
                core.info(`Update result: HTTP ${res.status}`);
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
                core.info(`Create result: HTTP ${res.status}`);
                return Promise.resolve();
            }
        }
    },
});
const run = () => {
    const actionProps = (0, props_1.extractProps)();
    if (!actionProps) {
        core.setFailed("Failed to parse properties!");
    }
    else {
        core.info(`Parsed props, processing '${actionProps.action.type}'`);
        const res = processAction(actionProps)[actionProps.action.type]();
        res.catch((r) => core.setFailed(JSON.stringify({
            message: r.message,
            name: r.name,
            stack: r.stack
        })));
    }
};
run();
