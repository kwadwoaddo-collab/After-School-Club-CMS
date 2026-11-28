import { CONTRACT_TITLE, contractSections, formatPounds, joinChildNames, type ContractValues } from './template';

/** Accessible HTML rendering of the contract. Prefilled values are read-only text, never inputs. */
export function ContractDocument({ values }: { values: ContractValues }) {
    const { provider } = values;
    return (
        <article aria-labelledby="contract-title" className="space-y-6 text-[15px] leading-relaxed text-text bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
            <header className="text-center">
                <p className="text-lg font-bold text-text">{provider.providerName}</p>
                <h1 id="contract-title" className="text-xl font-bold text-text">{CONTRACT_TITLE}</h1>
                <p className="text-sm text-text-muted">Provider: {provider.providerName}</p>
                <p className="text-sm text-text-muted">{provider.address}</p>
                <p className="text-sm text-text-muted">Tel: {provider.phone}{provider.website ? ` | Web: ${provider.website}` : ''}</p>
                <p className="text-sm text-text-muted">Ofsted Registration No: {provider.ofstedRegNo} | Approved Body: Ofsted</p>
            </header>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface-alt/40 p-4 sm:grid-cols-[11rem_1fr] text-text">
                <dt className="font-semibold text-text-secondary">Parent/Guardian Name:</dt><dd className="text-text">{values.parentName}</dd>
                <dt className="font-semibold text-text-secondary">Child(ren):</dt><dd className="text-text">{joinChildNames(values.childNames)}</dd>
                <dt className="font-semibold text-text-secondary">Start Date:</dt><dd className="text-text">{values.startDate}</dd>
                <dt className="font-semibold text-text-secondary">Monthly Cost:</dt><dd className="text-text font-medium">{formatPounds(values.amountPence)}</dd>
                <dt className="font-semibold text-text-secondary">Payment Frequency:</dt><dd className="text-text">Monthly</dd>
            </dl>
            {contractSections(provider.providerName).map(section => (
                <section key={section.heading} aria-label={section.heading} className="space-y-2">
                    <h2 className="text-base font-bold text-text">{section.heading}</h2>
                    {section.intro && <p className="text-text-secondary">{section.intro}</p>}
                    <ul className="list-disc space-y-1 pl-6 text-text-secondary">{section.items.map(item => <li key={item}>{item}</li>)}</ul>
                    {section.note && <p className="mt-1 text-text-muted text-sm">{section.note}</p>}
                </section>
            ))}
            <section aria-label="Provider signature" className="space-y-2 pt-2 border-t border-border">
                <h2 className="text-base font-bold text-text">Agreement</h2>
                <p className="font-semibold text-text">Provider Signature:</p>
                {values.signatureImage
                    ? <img src={values.signatureImage} alt={`Signature of ${provider.signatoryName}`} className="h-12 object-contain object-left bg-white rounded px-2 py-1" />
                    : <p className="font-serif italic text-lg text-text">{provider.signatoryName}</p>}
                <p className="text-text-secondary">{provider.signatoryName}{provider.signatoryRole ? `, ${provider.signatoryRole}` : ''} for {provider.providerName}</p>
                <p className="text-text-muted text-sm">Date: {values.providerSignedDate}</p>
            </section>
        </article>
    );
}
