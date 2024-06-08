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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractProps = exports.ActionType = void 0;
const core = __importStar(require("@actions/core"));
var ActionType;
(function (ActionType) {
    ActionType["List"] = "list";
    ActionType["Upsert"] = "upsert";
    ActionType["Delete"] = "delete";
})(ActionType || (exports.ActionType = ActionType = {}));
const toActionType = (str) => Object.values(ActionType).find((a) => a.valueOf() === str);
const toNumber = (str) => {
    const num = Number(str);
    return Number.isNaN(num) ? undefined : num;
};
const props = {
    getRequired: (propName, validate) => {
        const str = core.getInput(propName, { required: true });
        const validated = validate(str);
        if (!validated)
            throw new Error(`'${str}' is not a valid value for '${propName}'!`);
        else
            return validated;
    },
    getRequiredStr: (propName) => props.getRequired(propName, (str) => str),
    getRequiredByAction: (propName, currentAction, requiredFor, validate) => {
        const required = requiredFor.find((r) => r === currentAction) !== undefined;
        const str = core.getInput(propName, { required: required });
        if (!str)
            return undefined;
        else {
            const validated = validate(str);
            if (!validated)
                throw new Error(`'${str}' is not a valid value for '${propName}'!`);
            else
                return validated;
        }
    },
    getRequiredByActionStr: (propName, currentAction, requiredFor) => props.getRequiredByAction(propName, currentAction, requiredFor, (str) => str),
};
const extractProps = () => {
    const actionType = props.getRequired("action", toActionType);
    const authUsername = core.getInput('repo-username');
    const authPassword = core.getInput('repo-password');
    const auth = !authUsername || !authPassword ? undefined : {
        username: authUsername,
        password: authPassword,
    };
    return {
        action: {
            type: actionType,
            endpointId: props.getRequired("endpoint-id", toNumber),
            stackName: props.getRequiredByActionStr("stack-name", actionType, [ActionType.Upsert, ActionType.Delete]),
        },
        portainer: {
            host: props.getRequiredStr("portainer-host"),
            apiKey: props.getRequiredStr("portainer-api-key"),
        },
        repo: {
            url: props.getRequiredByActionStr('repo-url', actionType, [ActionType.Upsert]),
            composeFilePath: props.getRequiredByActionStr('repo-compose-file-path', actionType, [ActionType.Upsert]),
            auth: auth,
        },
    };
};
exports.extractProps = extractProps;
