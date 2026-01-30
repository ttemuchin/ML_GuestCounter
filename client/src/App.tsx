import ContentArea from "./components/ContentArea";
import MainHeader from "./components/MainHeader";
import { ImageProvider } from "./context/ImageContext";
import { SessionProvider } from "./context/SessionContext";

function App() {
  return (
    <>
      <SessionProvider>
        <ImageProvider>
          <MainHeader />
          <ContentArea />
        </ImageProvider>
      </SessionProvider>
    </>
  );
}

export default App;
