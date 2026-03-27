/**
 * Rules / FAQ copy for the How-to-Play page.
 */
export function ChkobbaRulesContent() {
  return (
    <div className="text-left space-y-10 pt-2">
      <div>
        <h2 className="text-2xl sm:text-3xl font-ancient text-brass text-center mb-6">How to play Chkobba</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel-heavy p-5 rounded-2xl border-brass/10">
            <div className="text-brass font-ancient text-xl mb-2">01.</div>
            <h3 className="text-lg text-cream font-bold mb-2">The deal</h3>
            <p className="text-cream/60 text-sm leading-relaxed">
              Each player receives 3 cards, and 4 cards are placed face up on the table. The game is played with a traditional 40-card deck.
            </p>
          </div>
          <div className="glass-panel-heavy p-5 rounded-2xl border-brass/10">
            <div className="text-brass font-ancient text-xl mb-2">02.</div>
            <h3 className="text-lg text-cream font-bold mb-2">Capturing</h3>
            <p className="text-cream/60 text-sm leading-relaxed">
              On your turn, play a card. If its value matches a card on the table (or the sum of multiple cards), you capture them.
            </p>
          </div>
          <div className="glass-panel-heavy p-5 rounded-2xl border-brass/10">
            <div className="text-brass font-ancient text-xl mb-2">03.</div>
            <h3 className="text-lg text-cream font-bold mb-2">La Chkobba</h3>
            <p className="text-cream/60 text-sm leading-relaxed">
              If you capture the last card on the table, you make a &quot;Chkobba&quot; and immediately gain 1 extra point.
            </p>
          </div>
        </div>
      </div>

      <section className="glass-panel-heavy p-6 sm:p-8 rounded-3xl border-brass/10 space-y-6">
        <h2 className="text-2xl font-ancient text-brass">Scoring</h2>
        <p className="text-cream/70 text-sm leading-relaxed">
          To win a match, your team must reach the table&apos;s target score (often 21). Here&apos;s how points are counted at the end of each round:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { title: 'Carta (most cards)', body: 'The team that captured more than 20 cards earns 1 point.' },
            { title: 'Dinari (diamonds)', body: 'The team with more than 5 diamonds earns 1 point.' },
            { title: 'Bermila (sevens)', body: 'The team with the most 7s (or 6s as a tiebreaker) earns 1 point.' },
            { title: 'Sabaa El Haya (7 of diamonds)', body: 'Whoever captures the 7 of diamonds automatically earns 1 point.' },
          ].map((row) => (
            <div key={row.title} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-brass/20 flex items-center justify-center flex-shrink-0 text-brass font-bold text-sm">1</div>
              <div>
                <h4 className="text-cream font-bold text-sm">{row.title}</h4>
                <p className="text-cream/50 text-xs mt-0.5">{row.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-ancient text-brass text-center">FAQ</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Can I play Chkobba online for free?',
              a: 'Yes — on chkobba.app you can play for free with no signup and no download.',
            },
            {
              q: 'How do I play with friends remotely?',
              a: 'Create a table, copy the room code, and send it to your friends so they can join in real time.',
            },
            {
              q: 'Is the game available on mobile?',
              a: 'Yes. Chkobba.app is a web app optimized for mobile browsers on iPhone and Android.',
            },
            {
              q: 'What is the difference between Chkobba and Scopa?',
              a: 'Chkobba is the Tunisian variant of Italian Scopa. Core rules are similar, but scoring (Carta, Dinari, Bermila) follows the Tunisian tradition.',
            },
            {
              q: 'Can I play against bots?',
              a: 'Yes — you can add bots to practice or fill a table if you are alone.',
            },
          ].map((item) => (
            <details key={item.q} className="glass-panel-heavy p-4 rounded-2xl border-brass/10 group cursor-pointer">
              <summary className="text-cream font-bold text-sm list-none flex justify-between items-center gap-2">
                {item.q}
                <span className="text-brass group-open:rotate-180 transition-transform shrink-0">↓</span>
              </summary>
              <p className="mt-3 text-cream/60 text-sm">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
