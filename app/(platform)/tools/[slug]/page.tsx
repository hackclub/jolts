import {
  GuidePage,
  guideMetadata,
  guideStaticParams,
} from "@/components/guide-page"

export const dynamicParams = false

export function generateStaticParams() {
  return guideStaticParams("tools")
}

export async function generateMetadata(props: PageProps<"/tools/[slug]">) {
  const { slug } = await props.params
  return guideMetadata("tools", slug)
}

export default async function Page(props: PageProps<"/tools/[slug]">) {
  const { slug } = await props.params
  return <GuidePage contentType="tools" slug={slug} />
}
