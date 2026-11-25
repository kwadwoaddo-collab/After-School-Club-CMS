import { CONTRACT_TITLE, contractSections, formatPounds, joinChildNames, type ContractValues } from './template';

/** Accessible HTML rendering of the contract. Prefilled values are read-only text, never inputs. */
export function ContractDocument({ values }: { values: ContractValues }) {
    const { provider } = values;
    return (
        <article aria-labelledby="contract-title" className="space-y-5 text-[15px] leading-relaxed text-gray-900">
            <header className="text-center">
                <p className="text-lg font-bold">{provider.providerName}</p>
                <h1 id="contract-title" className="text-xl font-bold">{CONTRACT_TITLE}</h1>
                <p className="text-sm text-gray-700">Provider: {provider.providerName}</p>
                <p className="text-sm text-gray-700">{provider.address}</p>
                <p className="text-sm text-gray-700">Tel: {provider.phone}{provider.website ? ` | Web: ${provider.website}` : ''}</p>
                <p className="text-sm text-gray-700">Ofsted Registration No: {provider.ofstedRegNo} | Approved Body: Ofsted</p>
            </header>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-gray-300 p-4 sm:grid-cols-[11rem_1fr]">
                <dt className="font-semibold">Parent/Guardian Name:</dt><dd>{values.parentName}</dd>
                <dt className="font-semibold">Child(ren):</dt><dd>{joinChildNames(values.childNames)}</dd>
                <dt className="font-semibold">Start Date:</dt><dd>{values.startDate}</dd>
                <dt className="font-semibold">Monthly Cost:</dt><dd>{formatPounds(values.amountPence)}</dd>
                <dt className="font-semibold">Payment Frequency:</dt><dd>Monthly</dd>
            </dl>
            {contractSections(provider.providerName).map(section => (
                <section key={section.heading} aria-label={section.heading}>
                    <h2 className="text-base font-bold">{section.heading}</h2>
                    {section.intro && <p>{section.intro}</p>}
                    <ul className="list-disc space-y-1 pl-6">{section.items.map(item => <li key={item}>{item}</li>)}</ul>
                    {section.note && <p className="mt-1">{section.note}</p>}
                </section>
            ))}
            <section aria-label="Provider signature">
                <h2 className="text-base font-bold">Agreement</h2>
                <p className="font-semibold">Provider Signature:</p>
                {values.signatureImage
                    ? <img src={values.signatureImage} alt={`Signature of ${provider.signatoryName}`} className="h-12 object-contain object-left" />
                    : <p className="font-serif italic text-lg">{provider.signatoryName}</p>}
                <p>{provider.signatoryName}{provider.signatoryRole ? `, ${provider.signatoryRole}` : ''} for {provider.providerName}</p>
                <p>Date: {values.providerSignedDate}</p>
            </section>
        </article>
    );
}
