'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { sendReceiptEmail } from '../send-receipt';

export default function SendReceiptButton({paymentId, recipient, recordedStatus}:{paymentId:string;recipient:string;recordedStatus?:string}) {
    const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
    const [requestId,setRequestId]=useState('');
    const dialog=useRef<HTMLDialogElement>(null), cancelButton=useRef<HTMLButtonElement>(null), inFlight=useRef(false);
    const titleId=useId();
    useEffect(()=>{
        if(!confirming)return;
        const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
        const node=dialog.current;
        node?.showModal();cancelButton.current?.focus();
        return()=>{node?.close();opener?.focus();};
    },[confirming]);
    return <div className="text-left text-sm">
        {recordedStatus && <p className="mb-2 text-muted-foreground">{recordedStatus==='accepted'?'Previous receipt email accepted by service; inbox delivery unconfirmed.':recordedStatus==='not_sent'?'Previous receipt email was not sent.':'Previous sending outcome unconfirmed. Check before sending again.'}</p>}
        <button type="button" disabled={!recipient||busy} onClick={()=>{setMessage('');setConfirming(true);setRequestId(crypto.randomUUID());}} className="min-h-11 rounded-lg border border-border px-3 py-2 font-semibold text-primary disabled:opacity-50">Send receipt by email</button>
        {confirming && <dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!inFlight.current)setConfirming(false);}} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/60 sm:p-6">
            <h2 id={titleId} className="text-xl font-semibold">Send payment receipt?</h2>
            <p className="break-all">Recipient: <strong>{recipient}</strong></p>
            <p className="text-muted-foreground">This is a separate email action. Recording a payment never sends it automatically.</p>
            <div className="flex flex-wrap justify-end gap-3">
                <button ref={cancelButton} type="button" disabled={busy} onClick={()=>setConfirming(false)} className="min-h-11 rounded-lg border border-border px-4 py-2 font-semibold">Cancel</button>
                <button type="button" disabled={busy} onClick={async()=>{
                    if(inFlight.current)return;inFlight.current=true;setBusy(true);
                    try{
                        const result=await sendReceiptEmail({paymentId,requestId,expectedRecipient:recipient});
                        setMessage(result.success?'Email accepted by the sending service; inbox delivery is not confirmed.':result.error||'Email outcome not confirmed. Check before trying again.');setConfirming(false);
                    }catch{setMessage('Email outcome not confirmed. Check before trying again.');setConfirming(false);}
                    finally{inFlight.current=false;setBusy(false);}
                }} className="min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{busy?'Sending…':'Confirm send receipt'}</button>
            </div>
        </dialog>}
        {message && <p role="status" className="mt-2 max-w-sm text-muted-foreground">{message}</p>}
        {!recipient && <p className="text-muted-foreground">Add a parent email address before sending.</p>}
    </div>;
}
