import { useSucursal } from '@/contexts/SucursalContext';

export const SucursalName = () => {
  const { selectedId, sucursales } = useSucursal();
  const sucursal = sucursales.find((s) => s.id_sucursal === selectedId);

  return (
    <div style={{display:'flex',flex:1}}>
      <p style={{fontSize:'1.3rem',margin:'0 auto',fontWeight:'bold'}}>{sucursal?.nombre}</p>
    </div>
  )
}
