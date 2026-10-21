import { Grid, Table, type TableProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';

export default function ResponsiveTable<RecordType extends object>(props: TableProps<RecordType>) {
  const screens = Grid.useBreakpoint();
  const mobile = !screens.md;
  const decorateColumns = (columns: ColumnsType<RecordType>): ColumnsType<RecordType> => columns.map(column => {
    if ('children' in column) return { ...column, children: decorateColumns(column.children) };
    const label = typeof column.title === 'string' ? column.title : '';
    return {
      ...column,
      fixed: mobile ? undefined : column.fixed,
      ellipsis: mobile ? false : column.ellipsis,
      onCell: (record, index) => ({
        ...column.onCell?.(record, index),
        'data-label': label,
      }),
      onHeaderCell: current => ({
        ...column.onHeaderCell?.(current),
        'data-mobile-control': Boolean(column.sorter || column.filters || column.filterDropdown),
      }),
    };
  });

  return (
    <Table<RecordType>
      {...props}
      columns={decorateColumns(props.columns || [])}
      className={`responsive-table ${props.className || ''}`}
      scroll={mobile ? undefined : props.scroll}
      sticky={mobile ? false : props.sticky}
    />
  );
}
