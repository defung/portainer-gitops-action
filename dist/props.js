"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractProps = exports.ActionType = void 0;
const core_1 = __importDefault(require("@actions/core"));
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
        const str = core_1.default.getInput(propName, { required: true });
        const validated = validate(str);
        if (!validated)
            throw new Error(`'${str}' is not a valid value for '${propName}'!`);
        else
            return validated;
    },
    getRequiredStr: (propName) => props.getRequired(propName, (str) => str),
    getRequiredByAction: (propName, currentAction, requiredFor, validate) => {
        const required = requiredFor.find((r) => r === currentAction) !== undefined;
        const str = core_1.default.getInput(propName, { required: required });
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
    const authUsername = core_1.default.getInput('repo-username');
    const authPassword = core_1.default.getInput('repo-password');
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
