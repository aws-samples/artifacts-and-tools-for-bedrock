import { BreadcrumbGroup } from "@cloudscape-design/components";
import { useOnFollow } from "../../common/hooks/use-on-follow";
import { APP_NAME } from "../../common/constants";
import BaseAppLayout from "../../components/base-app-layout";
import SessionsTable from "./sessions-table";

export default function SessionsPage() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: APP_NAME,
              href: "/",
            },
            {
              text: "History",
              href: "/section1",
            },
          ]}
        />
      }
      content={<SessionsTable />}
    />
  );
}
