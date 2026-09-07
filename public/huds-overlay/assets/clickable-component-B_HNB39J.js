import{o as e}from"./rolldown-runtime-DAXXjFlN.js";import{$ as t,et as n,t as r}from"./useKitClientHandler-C0Qdfd8s.js";import{n as i}from"./overlay-mode-provider-Cw-Py3fz.js";import{t as a}from"./utils-DlEW7jYo.js";var o=e(n(),1),s=t(),c=[`#d2ffa8`,`#ffe9a8`,`#a8efff`,`#ffc0a8`,`#bda8ff`],l=({children:e,className:t,componentId:n,fieldId:l,makeTransparent:u=!0})=>{let{getComponent:d,selectComponent:f,selectedComponentId:p,selectedScreenId:m}=r(),h=i(),g=(0,o.useMemo)(()=>{let e=d(m,n);return l?e?.defaultToggled&&(e?.fields?.[l]?.value??!1):e?.defaultToggled??!1},[d,m,n,l]),[_,v]=(0,o.useState)(``);(0,o.useEffect)(()=>{let e=Math.floor(Math.random()*c.length);v(c[e]||``)},[]);let y=e=>{let t=e.currentTarget.dataset.componentId||n;f(p===t?``:t)},b=l?`${n}__FIELD__${l}`:n;return(0,s.jsx)(`div`,{className:a(h&&`clickable-component cursor-pointer transition-opacity`,h&&p===b&&`selected`,u&&h&&(g?`opacity-30`:`opacity-50`),!h&&`border-0 border-none`,!g&&`[&>*]:invisible`,t),"data-component-id":b,"data-make-transparent":u,onClick:y,style:{background:u&&h&&!g?`repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              ${_} 10px,
              ${_} 20px
            )`:void 0},children:e})};export{l as t};
//# sourceMappingURL=clickable-component-B_HNB39J.js.map