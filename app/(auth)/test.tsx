import { Dimensions, StyleSheet, Text, View } from "react-native";

const { width } = Dimensions.get("window");

const getBoxStyle = () => {
  const baseMargin = 10;

  if (width < 600) {
    // Mobile
    return {
      width: width - baseMargin * 2, // full width with some padding
      aspectRatio: 2.5,
      marginBottom: baseMargin,
    };
  }

  if (width < 1024) {
    // Tablet
    return {
      width: (width - baseMargin * 3) / 2, // two columns with margin
      aspectRatio: 2,
      marginRight: baseMargin,
      marginBottom: baseMargin,
    };
  }

  if (width < 1280) {
    // Laptop
    return {
      width: (width - baseMargin * 4) / 3, // three columns
      aspectRatio: 1.8,
      marginRight: baseMargin,
      marginBottom: baseMargin,
    };
  }

  // Desktop
  return {
    width: (width - baseMargin * 5) / 4, // four columns
    aspectRatio: 1.5,
    marginRight: baseMargin,
    marginBottom: baseMargin,
  };
};

const getDeviceType = () => {
  if (width < 600) return "mobile";
  if (width < 1024) return "tablet";
  if (width < 1280) return "laptop";
  return "desktop";
};

const getBoxColor = () => {
  switch (getDeviceType()) {
    case "mobile":
      return "#ff69b4";
    case "tablet":
      return "#34a85a";
    case "laptop":
      return "#8e24aa";
    case "desktop":
      return "#4CAF50";
    default:
      return "#ccc";
  }
};

const ResponsiveBoxes = () => {
  const boxes = ["Box 1", "Box 2", "Box 3", "Box 4"];

  return (
    <View style={styles.container}>
      {boxes.map((text, index) => (
        <View
          key={index}
          style={[
            styles.box,
            getBoxStyle(),
            { backgroundColor: getBoxColor() },
          ]}
        >
          <Text style={styles.boxText}>{text}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 10,
  },
  box: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 10,
  },
  boxText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default ResponsiveBoxes;
