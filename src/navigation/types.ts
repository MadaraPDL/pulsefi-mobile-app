export type RootStackParamList = {
  Login: undefined;
  App: undefined;
};

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
      }
    | undefined;
};
