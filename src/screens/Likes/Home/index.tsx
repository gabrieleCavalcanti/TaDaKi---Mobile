import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import FeedScreen from "./FeedScreen";
export default function HomeScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "Home">) {
  return (
    <FeedScreen
      navigation={navigation}
      initialFavorites={Boolean(route.params?.favoritos)}
    />
  );
}
