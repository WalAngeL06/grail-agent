import { PageHead } from "../components/Bits";
import { T } from "../i18n";

// Rehber / Tutorial: six short steps for a first-time visitor (text mirrors docs/TUTORIAL.md once docs publishes it).
// Method and product names stay English in both languages.
const steps = () => [
  {
    title: T("What is this site?", "Bu site ne?"),
    text: T(
      "GRAIL is an AI agent that makes its own crypto buy and sell decisions. It seals every decision on Avalanche BEFORE the trade, so it can't change or hide it later.",
      "GRAIL, kendi kendine kripto alım-satım kararı veren bir AI agent. Her kararını işlemden ÖNCE Avalanche'a mühürler; sonradan değiştiremez, saklayamaz.",
    ),
    href: "#/how",
    link: T("How it works →", "Nasıl çalışır →"),
  },
  {
    title: T("What is the agent doing right now?", "Agent şu an ne yapıyor?"),
    text: T(
      "The Dashboard starts with a one-sentence summary and a 5-step strip: Market → Decision → Sealed → Order → Opened.",
      "Panel'in en üstünde tek cümlelik bir özet ve 5 adımlı akış şeridi var: Piyasa → Karar → Mühür → Emir → Açılış.",
    ),
    href: "#/dashboard",
    link: T("Show →", "Göster →"),
  },
  {
    title: T("Why did it buy, why did it wait?", "Neden aldı, neden beklemedi?"),
    text: T(
      'Decisions shows the reason for every coin, "Is the market ranging? (Hurst)" and the AI second-opinion badge.',
      'Kararlar ekranında her coin için gerekçe, "Piyasa yatay mı? (Hurst)" çipi ve AI ikinci görüş rozeti var.',
    ),
    href: "#/decisions",
    link: T("Show →", "Göster →"),
  },
  {
    title: T("Verify it yourself", "Kendin doğrula"),
    text: T(
      'Press "Verify yourself" on a card in Decisions: your browser computes the decision\'s fingerprint (hash) itself and compares it with the seal on Avalanche. Green = identical; press "Try to cheat" to change one number and watch it turn red.',
      'Kararlar\'da bir kartta "Verify yourself" düğmesine bas: tarayıcın kararın parmak izini (hash) kendisi hesaplar ve Avalanche\'taki mühürle karşılaştırır. Yeşil = birebir aynı; "Try to cheat" ile tek bir sayıyı değiştir, kırmızıya döndüğünü gör.',
    ),
    href: "#/decisions",
    link: T("Show →", "Göster →"),
  },
  {
    title: T("No cherry-picking", "Sicil seçilemez"),
    text: T(
      "The On-chain Ledger shows whether every seal was opened; the number of unopened envelopes is visible to everyone. The first real order: check-in #2.",
      "Zincir Kaydı her mührün açılıp açılmadığını gösterir; açılmamış zarf sayısı herkese görünür. İlk gerçek emir: check-in #2.",
    ),
    href: "#/ledger",
    link: T("Show →", "Göster →"),
  },
  {
    title: T("What can it do with your money, and what can't it?", "Parana ne yapabilir, ne yapamaz?"),
    text: T(
      "Safety limits: spot only, no leverage, it can't withdraw money, per-order and total limits, and an emergency stop (kill switch). Only a human can switch it to real money.",
      "Güvenlik limitleri: sadece spot, kaldıraç yok, para çekemez; emir başı ve toplam limit, acil durdurma (kill switch). Gerçek moda geçişi sadece insan yapar.",
    ),
    href: "#/settings",
    link: T("Show →", "Göster →"),
  },
];

export default function Guide() {
  return (
    <>
      <PageHead
        eyebrow={T("Tutorial", "Rehber")}
        title={T("GRAIL in six short steps.", "Altı kısa adımda GRAIL.")}
        summary={T("Plain words first; the technical names stay in English.", "Önce sade anlatım; teknik adlar İngilizce kalır.")}
      />
      <div className="how guide">
        {steps().map((st, i) => (
          <article key={i} className="card how-card guide-card">
            <span className="guide-n" aria-hidden="true">
              {i + 1}
            </span>
            <h2>{st.title}</h2>
            <p>{st.text}</p>
            <a className="linkbtn" href={st.href}>
              {st.link}
            </a>
          </article>
        ))}
      </div>
      <section className="card guide-try" aria-label={T("Try it in 3 minutes", "3 dakikada dene")}>
        <b>{T("Try it in 3 minutes", "3 dakikada dene")}</b>
        <ol>
          <li>
            <a href="#/decisions">{T("Open Decisions", "Kararlar'ı aç")}</a>
          </li>
          <li>{T('Press "Verify yourself"', '"Verify yourself"e bas')}</li>
          <li>{T('Under "Try to cheat", press "Change one number"', '"Try to cheat" bölümünde "Bir sayıyı değiştir"e bas')}</li>
        </ol>
      </section>
    </>
  );
}
