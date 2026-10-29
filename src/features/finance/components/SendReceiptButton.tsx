'use client';
import { useState } from 'react';
import { sendReceiptEmail } from '../send-receipt';

export default function SendReceiptButton({paymentId, recipient, recordedStatus}:{paymentId:string;recipient:string;recordedStatus?:string}) {
    const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
    const [requestId,setRequestId]=useState('');
    return <div className="text-left text-sm">
        {recordedStatus && <p className="mb-2 text-muted-foreground">{recordedStatus==='accepted'?'Previous receipt email accepted by service; inbox delivery unconfirmed.':recordedStatus==='not_sent'?'Previous receipt email was not sent.':'Previous sending outcome unconfirmed. Check before sending again.'}</p>}
        {!confirming && <button type="button" disabled={!recipient} onClick={()=>{setMessage('');setConfirming(true);setRequestId(crypto.randomUUID());}} className="min-h-11 rounded-lg border border-border px-3 py-2 font-semibold text-primary disabled:opacity-50">Send receipt by email</button>}
        {confirming && <div className="space-y-2 rounded-lg border border-border bg-card p-3"><p className="break-all">Send this payment receipt to <strong>{recipient}</strong>?</p><p className="text-muted-foreground">This is a separate email action. Recording a payment never sends it automatically.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);try{const result=await sendReceiptEmail({paymentId,requestId,expectedRecipient:recipient});setMessage(result.success?'Email accepted by the sending service; inbox delivery is not confirmed.':result.error||'Email outcome not confirmed. Check before trying again.');setConfirming(false);}catch{setMessage('Email outcome not confirmed. Check before trying again.');setConfirming(false);}finally{setBusy(false);}}} className="min-h-11 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">{busy?'Sending…':'Confirm send receipt'}</button><button type="button" disabled={busy} onClick={()=>setConfirming(false)} className="min-h-11 rounded-lg border border-border px-3 py-2">Cancel</button></div></div>}
        {message && <p role="status" className="mt-2 max-w-sm text-muted-foreground">{message}</p>}
        {!recipient && <p className="text-muted-foreground">Add a parent email address before sending.</p>}
    </div>;
}
