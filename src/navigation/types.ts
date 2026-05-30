import type { NavigatorScreenParams } from "@react-navigation/native";

export type PulseFiAssistantTargetType = "prediction" | "recommendation";

export type AppTabParamList = {
  Home: undefined;
  Usage: undefined;
  Devices: undefined;
  Alerts: undefined;
  More:
    | {
        section?: "assistant" | "plans" | "routers" | "planRequest" | "insights" | "profile";
        assistantQuestion?: string;
        assistantQuestionKey?: number;
        assistantTargetType?: PulseFiAssistantTargetType;
        assistantTargetId?: string;
      }
    | undefined;
};

export type RootStackParamList = {
  Login: undefined;
  App: NavigatorScreenParams<AppTabParamList> | undefined;
};
