import "server-only";

type TextParameter = { type: "text"; text: string };
type ImageParameter = { type: "image"; image: { link: string } };

type TemplateComponent =
  | { type: "header"; parameters: ImageParameter[] }
  | { type: "body"; parameters: TextParameter[] };

// Monta o array `components` do payload de template da Meta Cloud API.
// Se imagemUrl for fornecida, adiciona um header de imagem antes do body.
export function montarComponentsTemplate(
  variaveis: string[],
  imagemUrl: string | undefined,
): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  if (imagemUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: imagemUrl } }],
    });
  }

  components.push({
    type: "body",
    parameters: variaveis.map((v) => ({ type: "text", text: v })),
  });

  return components;
}
