export default function OrderTimeline({status,pickup=false}:{status:string;pickup?:boolean}){
 const steps=[['pending_confirmation','Order received'],['confirmed','Confirmed'],['preparing','Preparing'],['ready_for_pickup',pickup?'Ready to collect':'Ready'],['shipped',pickup?'Ready to collect':'Dispatched'],['delivered',pickup?'Collected':'Delivered']];const current=steps.findIndex(([value])=>value===status);
 if(status==='cancelled')return <p className="notice">This order has been cancelled. Contact the studio for any payment or refund questions.</p>;
 return <ol className="order-timeline" aria-label="Order progress">{steps.map(([value,label],index)=><li key={value} className={index<=current?'complete':''} aria-current={index===current?'step':undefined}><span aria-hidden="true">{index<current?'✓':index+1}</span><strong>{label}</strong>{index===current&&<small>Current status</small>}</li>)}</ol>;
}
