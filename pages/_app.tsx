import "../styles/globals.css";
import { Poppins } from 'next/font/google';
import './katex.min.css';

const poppins = Poppins({
  weight: '400',
  subsets: ['latin']
})

function MyApp({ Component, pageProps }) {
  return (
    <main className={poppins.className}>
      <Component {...pageProps} />
    </main>
  );
}

export default MyApp;
