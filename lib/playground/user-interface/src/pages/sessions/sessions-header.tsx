import {
  Button,
  Header,
  HeaderProps,
  SpaceBetween,
} from "@cloudscape-design/components";
import { ListSessionData } from "../../common/api-client/sessions-client";
import { useNavigate } from "react-router-dom";
import RouterButton from "../../components/wrappers/router-button";

interface AllItemsPageHeaderProps extends HeaderProps {
  title?: string;
  createButtonText?: string;
  selectedItems: readonly ListSessionData[];
  refresh: () => Promise<void>;
}

export function SessionsHeader({
  title = "Sessions",
  ...props
}: AllItemsPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <Header
      variant="awsui-h1-sticky"
      actions={
        <SpaceBetween size="xs" direction="horizontal">
          <Button iconName="refresh" onClick={() => props.refresh()} />
          <RouterButton
            data-testid="header-btn-view-details"
            disabled={props.selectedItems.length !== 1}
            onClick={() =>
              navigate(`/chat/${props.selectedItems[0].sessionId}`)
            }
          >
            View
          </RouterButton>
        </SpaceBetween>
      }
      {...props}
    >
      {title}
    </Header>
  );
}
