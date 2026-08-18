import {
  GuidePage,
  guideMetadata,
  guideStaticParams,
} from "@/components/guide-page"

export const dynamicParams = false

export function generateStaticParams() {
  return guideStaticParams("concepts")
}

export async function generateMetadata(props: PageProps<"/concepts/[slug]">) {
  const { slug } = await props.params
  return guideMetadata("concepts", slug)
}

export default async function Page(props: PageProps<"/concepts/[slug]">) {
  const { slug } = await props.params
  return <GuidePage contentType="concepts" slug={slug} />
}
