"use client";

import { useState } from "react";
import { Modal, Form, Input, Button, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { toast } from "sonner";
import { createExpenseCategory } from "@/lib/actions/expenses";

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
}

export function ManageCategoriesModal({ open, onOpenChange, categories }: Readonly<ManageCategoriesModalProps>) {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const onFinish = async (values: any) => {
    setIsLoading(true);
    try {
      const res = await createExpenseCategory(values);
      if (res.error) throw new Error(res.error);
      
      toast.success("Category added successfully");
      form.resetFields();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: ColumnsType<ExpenseCategory> = [
    { title: "Name", dataIndex: "name", key: "name", width: "40%" },
    { title: "Description", dataIndex: "description", key: "description" },
  ];

  return (
    <Modal
      title="Manage Expense Categories"
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      width={700}
    >
      <div className="grid md:grid-cols-2 gap-6 pt-4">
        <div>
          <h3 className="text-sm font-medium mb-3">Add New Category</h3>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              name="name"
              label="Category Name"
              rules={[{ required: true, message: "Please enter a name" }]}
            >
              <Input placeholder="e.g., Salary" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description (Optional)"
            >
              <Input.TextArea placeholder="Add notes..." rows={2} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={isLoading} className="w-full bg-violet-600">
              Add Category
            </Button>
          </Form>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3">Existing Categories</h3>
          <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto scrollbar-hide">
            <Table
              dataSource={categories}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
