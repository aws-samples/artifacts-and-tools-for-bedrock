import {
  Box,
  Button,
  Pagination,
  PropertyFilter,
  SpaceBetween,
  Table,
  TableProps,
} from "@cloudscape-design/components";
import {
  useCollection,
  PropertyFilterProperty,
  PropertyFilterOperator,
} from "@cloudscape-design/collection-hooks";
import { useState, useEffect, useCallback } from "react";
import { ApiClient } from "../../common/api-client/api-client";
import { TextHelper } from "../../common/helpers/text-helper";
import { PropertyFilterI18nStrings } from "../../common/i18n/property-filter-i18n-strings";
import { ListSessionData } from "../../common/api-client/sessions-client";
import { SessionsHeader } from "./sessions-header";
import RouterLink from "../../components/wrappers/router-link";

const ItemsColumnDefinitions: TableProps.ColumnDefinition<ListSessionData>[] = [
  {
    id: "title",
    header: "Title",
    sortingField: "title",
    cell: (item) => (
      <RouterLink href={`/chat/${item.sessionId}`}>{item.title}</RouterLink>
    ),
    isRowHeader: true,
  },
  {
    id: "created",
    header: "Started At",
    sortingField: "created",
    cell: (item) => item.created,
  },
];

const ItemColumnFilteringProperties: PropertyFilterProperty[] = [
  {
    propertyLabel: "Title",
    key: "title",
    groupValuesLabel: "Title values",
    operators: [":", "!:", "=", "!="] as PropertyFilterOperator[],
  },
  {
    propertyLabel: "Started At",
    key: "created",
    groupValuesLabel: "Started At",
    defaultOperator: ">" as PropertyFilterOperator,
    operators: ["<", "<=", ">", ">="] as PropertyFilterOperator[],
  },
].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));

export default function SessionsTable() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ListSessionData[]>([]);
  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(data, {
    propertyFiltering: {
      filteringProperties: ItemColumnFilteringProperties,
      empty: (
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <div>
            <b>No Sessions</b>
            <Box variant="p" color="inherit">
              No sessions have been created yet.
            </Box>
          </div>
        </Box>
      ),
      noMatch: (
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="xxs">
            <div>
              <b>No matches</b>
              <Box variant="p" color="inherit">
                We can't find a match.
              </Box>
            </div>
            <Button
              onClick={() =>
                actions.setPropertyFiltering({ tokens: [], operation: "and" })
              }
            >
              Clear filter
            </Button>
          </SpaceBetween>
        </Box>
      ),
    },
    pagination: { pageSize: 50 },
    sorting: {
      defaultState: {
        sortingColumn: ItemsColumnDefinitions[1],
        isDescending: true,
      },
    },
    selection: {},
  });

  useEffect(() => {
    (async () => {
      const apiClient = new ApiClient();
      const sessions = await apiClient.sessions.listSessions();
      setData(sessions);
      setLoading(false);
    })();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const apiClient = new ApiClient();
    const sessions = await apiClient.sessions.listSessions();
    setData(sessions);
    setLoading(false);
  }, []);

  return (
    <Table
      {...collectionProps}
      items={items}
      columnDefinitions={ItemsColumnDefinitions}
      selectionType="single"
      variant="full-page"
      stickyHeader={true}
      resizableColumns={true}
      header={
        <SessionsHeader
          selectedItems={collectionProps.selectedItems ?? []}
          refresh={refresh}
          counter={
            loading
              ? undefined
              : TextHelper.getHeaderCounterText(
                  data,
                  collectionProps.selectedItems,
                )
          }
        />
      }
      loading={loading}
      loadingText="Loading Items"
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings}
          filteringPlaceholder={"Filter Items"}
          countText={TextHelper.getTextFilterCounterText(filteredItemsCount)}
          expandToViewport={true}
        />
      }
      pagination={<Pagination {...paginationProps} />}
    />
  );
}
