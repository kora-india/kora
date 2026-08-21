"use client";

import { useState } from "react";
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button } from "antd";
import dayjs from "dayjs";
import { toast } from "sonner";
import { createExpense } from "@/lib/actions/expenses";

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
}

export function AddExpenseModal({ open, onOpenChange, categories }: Readonly<AddExpenseModalProps>) {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const onFinish = async (values: any) => {
    setIsLoading(true);
    try {
      const data = {
        ...values,
        date: values.date.format("YYYY-MM-DD"),
        amount: Number(values.amount),
      };

      const res = await createExpense(data);
      if (res.error) throw new Error(res.error);
      
      toast.success("Expense added successfully");
      form.resetFields();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      title="Add Expense"
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ date: dayjs() }}
        className="mt-4"
      >
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: "Please enter a title" }]}
        >
          <Input placeholder="e.g., Bus Fuel" />
        </Form.Item>

        <div className="flex gap-4">
          <Form.Item
            name="amount"
            label="Amount (₹)"
            className="flex-1"
            rules={[{ required: true, message: "Amount is required" }]}
          >
            <InputNumber className="w-full" min={0} placeholder="0.00" />
          </Form.Item>

          <Form.Item
            name="date"
            label="Date"
            className="flex-1"
            rules={[{ required: true, message: "Date is required" }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
        </div>

        <Form.Item
          name="categoryId"
          label="Category"
          rules={[{ required: true, message: "Please select a category" }]}
        >
          <Select placeholder="Select category">
            {categories.map((cat) => (
              <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <div className="flex gap-4">
          <Form.Item
            name="paymentMethod"
            label="Payment Method"
            className="flex-1"
            rules={[{ required: true, message: "Payment method is required" }]}
          >
            <Select placeholder="Select method">
              <Select.Option value="CASH">Cash</Select.Option>
              <Select.Option value="ONLINE">Online/Bank Transfer</Select.Option>
              <Select.Option value="CHEQUE">Cheque</Select.Option>
              <Select.Option value="UPI">UPI</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="referenceNo"
            label="Reference / Chq No."
            className="flex-1"
          >
            <Input placeholder="Optional" />
          </Form.Item>
        </div>

        <Form.Item
          name="description"
          label="Description (Optional)"
        >
          <Input.TextArea placeholder="Add notes..." rows={2} />
        </Form.Item>

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="primary" htmlType="submit" loading={isLoading} className="bg-violet-600">
            Save Expense
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
