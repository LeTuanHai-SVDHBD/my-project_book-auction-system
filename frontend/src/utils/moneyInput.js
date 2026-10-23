/** Tiền VND dạng chữ số nguyên: định dạng dấu chấm và quy đổi vị trí con trỏ, không qua Number. */
export function moneyDigits(value){return String(value??'').replace(/[^0-9]/g,'').replace(/^0+(?=\d)/,'');}
export function formatMoneyInput(digits){return digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
export function positionAfterDigits(display,count){
  if(count<=0)return 0;
  let found=0;for(let index=0;index<display.length;index++)if(/[0-9]/.test(display[index])&&++found===count)return index+1;
  return display.length;
}
export function editMoneyInput(display,caret){
  const before=display.slice(0,caret).replace(/[^0-9]/g,'').length;
  const all=display.replace(/[^0-9]/g,'');const digits=moneyDigits(display);
  return {digits,caret:positionAfterDigits(formatMoneyInput(digits),Math.max(0,before-(all.length-digits.length)))};
}
