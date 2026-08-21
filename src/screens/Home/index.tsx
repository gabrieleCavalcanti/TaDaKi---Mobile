import { View, Text, Button } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View>
      <Text>Home</Text>

      <Button
        title="Perfil"
        onPress={() => navigation.navigate("Perfil")}
      />
    </View>
  );
}