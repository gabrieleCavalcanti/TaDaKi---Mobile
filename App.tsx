import { SafeAreaProvider } from "react-native-safe-area-context";
import Dashboard from "./src/screens/Dashboard";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./src/screens/Login";
import Cadastro from "./src/screens/Cadastro";
import HomeScreen from "./src/screens/Home";
import Perfil from "./src/screens/Perfil";
import Likes from "./src/screens/Likes";
import Sobre from "./src/screens/Institucional/Sobre";
import Ajuda from "./src/screens/Institucional/Ajuda";
import Home from "./src/screens/Home";
import PerfilPessoalScreen from "./src/screens/PerfilPessoal/"; // ajuste o caminho

export type RootStackParamList = {
  Login: undefined;
  Cadastro: undefined;
  Home: { favoritos?: boolean } | undefined;
  Dashboard: undefined;
  Perfil: { id_pessoa: number };
  PerfilPessoal: undefined;
  Likes: undefined;
  Favoritos: undefined;
  Sobre: undefined;
  Ajuda: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
// Reúne as telas do aplicativo.
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Cadastro" component={Cadastro} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Perfil" component={Perfil} />
          <Stack.Screen
            name="PerfilPessoal"
            component={PerfilPessoalScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="Likes" component={Likes} />
          <Stack.Screen name="Sobre" component={Sobre} />
          <Stack.Screen name="Ajuda" component={Ajuda} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
