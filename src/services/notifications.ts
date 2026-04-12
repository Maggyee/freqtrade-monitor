import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let initialized = false;

export const initializeNotifications = async () => {
  if (initialized) return;
  initialized = true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: '#2D7FF9',
    });
  }
};

export const getNotificationPermission = async () => {
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

export const requestNotificationPermission = async () => {
  await initializeNotifications();
  const settings = await Notifications.requestPermissionsAsync();
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

export const sendLocalNotification = async (title: string, body: string, data?: Record<string, string | number>) => {
  await initializeNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
    },
    trigger: null,
  });
};
