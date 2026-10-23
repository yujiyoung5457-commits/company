import ApplicationDashboard, {
  type Application,
} from "./components/ApplicationDashboard";
import jobkoreaData from "./data/jobkorea.json";
import saraminData from "./data/saramin.json";

export default function Home() {
  const applications = [
    ...(saraminData as Application[]),
    ...(jobkoreaData as Application[]),
  ];

  return <ApplicationDashboard applications={applications} />;
}
