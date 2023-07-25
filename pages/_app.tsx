import "../styles/globals.css";
import { Poppins } from 'next/font/google';
import './katex.min.css';
import Script from "next/script";

const poppins = Poppins({
  weight: '400',
  subsets: ['latin']
})

function MyApp({ Component, pageProps }) {
  return (
    <main className={poppins.className}>
      <script src="/algebra.js" type="text/javascript" />
      <Component {...pageProps} />
    </main>
  );
}

export default MyApp;
