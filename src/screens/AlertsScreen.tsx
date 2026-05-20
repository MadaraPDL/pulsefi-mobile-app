import { ScrollView, StyleSheet, Text, View } from "react-native";

export function AlertsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Alerts</Text>
      <Text style={styles.title}>Network alerts</Text>
      <Text style={styles.subtitle}>
        Next step: connect this screen to /me/alerts and mark alerts as read.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coming next</Text>
        <Text style={styles.cardText}>High usage alerts</Text>
        <Text style={styles.cardText}>New device alerts</Text>
        <Text style={styles.cardText}>Policy failure alerts</Text>
      </View>
    </ScrollView>
  );
}

export default AlertsScreen;

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
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#102033",
  },
  cardText: {
    fontSize: 15,
    color: "#33465B",
  },
});
