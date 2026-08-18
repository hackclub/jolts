import {
  GuideContent,
  guideMetadata,
  guideStaticParams,
} from "@/components/guide-page"

export const dynamicParams = false

export function generateStaticParams() {
  return guideStaticParams("guides")
}

export async function generateMetadata(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params
  return guideMetadata("guides", slug)
}

export default async function Page(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params
  return <GuideContent slug={slug} />
}
