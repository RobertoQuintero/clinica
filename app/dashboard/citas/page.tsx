"use client";

import { useSucursal } from "@/contexts/SucursalContext";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCitas,
  getPacientes,
  getPodologos,
  getServicioOpciones,
  getSucursalIframe,
  type IExternalEvent,
} from "./actions";



export default function CitasPage() {
  const { selectedId }                    = useSucursal();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [linkCalendar, setLinkCalendar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    setLoading(true);
    getSucursalIframe(selectedId).then((sucursal) => {
      if(sucursal){

      setIframeSrc(sucursal?.iframe ?? null);
      setLinkCalendar(sucursal?.link_calendar ?? null);
      setLoading(false)
    }
  }).catch((error) => {
    setLoading(false)
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedId]);


  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-50">Citas</h2>
     
        <button
            onClick={() => {
              if (linkCalendar) {
                window.open(linkCalendar, "_blank");
              }
            }}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-600 dark:hover:bg-zinc-500"
          >
            + Nueva cita
          </button>
        
       
      </div>
      <div className="calendar-container">
        {loading ? (
          <p>Espere ...</p>
        ) : (
          iframeSrc ? (
            <iframe className="google-calendar-iframe" src={iframeSrc}></iframe>
          ) : <></>
        )}
      </div>

      
    </div>
  );
}



