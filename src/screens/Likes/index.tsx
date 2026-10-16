import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { FeedScreen } from "../Home";
export default function LikesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Likes">) {
  return <FeedScreen navigation={navigation} onlyLikes />;
}
