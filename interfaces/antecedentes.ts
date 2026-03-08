export interface IAntecedenteMedico {
    id_antecedente_medico:       number;
    id_paciente:                 number;
    fecha_registro:              Date | string;
    alergia_anestesia:           boolean;
    alergia_antibioticos:        boolean;
    alergia_sulfas:              boolean;
    alergia_latex:               boolean;
    alergia_ninguna:             boolean;
    diabetico:                   boolean;
    hipertenso:                  boolean;
    hipotiroidismo:              boolean;
    cancer:                      boolean;
    embarazada:                  boolean;
    lactando:                    boolean;
    fracturas:                   boolean;
    antecedentes_dermatologicos: boolean;
    medicamentos_actuales:       string;
    tipo_sangre:                 string;
    otros:                       string;
}
