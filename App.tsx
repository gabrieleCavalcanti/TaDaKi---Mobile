import { SafeAreaProvider } from "react-native-safe-area-context";
import Dashboard from "./src/screens/Dashboard";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./src/screens/Login";
import Cadastro from "./src/screens/Cadastro";
import Home from "./src/screens/Home";
import Perfil from "./src/screens/Perfil";
import Likes from "./src/screens/Likes";
export type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  Home: { favoritos?: boolean } | undefined;
  Dashboard: undefined;
  Perfil: { id_pessoa: number };
  Likes: undefined;
  Favoritos: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
// Reúne as telas do aplicativo.
export default function App() {
  return (
    <SafeAreaProvider>
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Cadastro" component={Cadastro} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Perfil" component={Perfil} />
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="Likes" component={Likes} />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
