import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function AppTabs() {
  const colors = useAppTheme();

  return (
    <NativeTabs
      backgroundColor={colors.cartaoFundo}
      indicatorColor={colors.superficieVerdeSelecionada}
      labelStyle={{ selected: { color: colors.texto } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
