declare module "react-native-keyboard-aware-scroll-view" {
  import type { ComponentType } from "react";
  import type { ScrollViewProps } from "react-native";

  export type KeyboardAwareScrollViewProps = ScrollViewProps & {
    enableOnAndroid?: boolean;
    extraHeight?: number;
    extraScrollHeight?: number;
    showsVerticalScrollIndicator?: boolean;
  };

  export const KeyboardAwareScrollView: ComponentType<KeyboardAwareScrollViewProps>;
}
