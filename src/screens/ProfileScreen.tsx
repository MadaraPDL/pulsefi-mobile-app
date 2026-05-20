import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AppUserSession } from "../types/appUser";

type ProfileScreenProps = {
  session: AppUserSession;
  onLogout: () => Promise<void>;
};

export function ProfileScreen({ session, onLogout }: ProfileScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Profile</Text>
      <Text style={styles.title}>My account</Text>
      <Text style={styles.subtitle}>
        This app is for App User accounts only.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Name</Text>
        <Text style={styles.cardTitle}>{session.full_name}</Text>

        <Text style={styles.cardLabel}>Email</Text>
        <Text style={styles.cardText}>{session.email}</Text>

        <Text style={styles.cardLabel}>Username</Text>
        <Text style={styles.cardText}>{session.username ?? "Not set"}</Text>

        <Text style={styles.cardLabel}>Account ID</Text>
        <Text style={styles.smallText}>{session.account_id}</Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void onLogout()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
    backgroundColor: "#F6F8FB",
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    color: "#00A7D8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#102033",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5D6B7A",
  },
  card: {
    borderRadius: 22,
    padding: 18,
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAF2",
  },
  cardLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#617083",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#102033",
  },
  cardText: {
    fontSize: 15,
    color: "#33465B",
  },
  smallText: {
    fontSize: 12,
    color: "#6B7888",
  },
  logoutButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: "#102033",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
});
