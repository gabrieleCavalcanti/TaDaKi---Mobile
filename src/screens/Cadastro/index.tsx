import { View, Text, Button } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Cadastro">;

export default function CadastroScreen({ navigation }: Props) {
  return (
    <View>
      <Text>Cadastro</Text>

      <Button
        title="Voltar para Login"
        onPress={() => navigation.navigate("Login")}
      />
    </View>
  );
}